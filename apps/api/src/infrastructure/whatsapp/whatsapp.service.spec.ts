import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { SupabaseService } from '../supabase/supabase.service';

// ── Mocks ──────────────────────────────────────────────────────

const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom   = jest.fn().mockReturnValue({ insert: mockInsert });

const mockSupabase = {
  getAdminClient: () => ({ from: mockFrom }),
} as unknown as SupabaseService;

function makeConfig(overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string> = {
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_ACCESS_TOKEN: 'test-token',
  };
  return {
    get: (key: string) => overrides[key] ?? defaults[key],
  } as unknown as ConfigService;
}

async function buildService(config = makeConfig()): Promise<WhatsAppService> {
  const module = await Test.createTestingModule({
    providers: [
      WhatsAppService,
      { provide: ConfigService, useValue: config },
      { provide: SupabaseService, useValue: mockSupabase },
    ],
  }).compile();
  return module.get(WhatsAppService);
}

const META_SUCCESS = {
  ok: true,
  json: async () => ({ messages: [{ id: 'wamid.abc123' }] }),
};

// ── Tests ──────────────────────────────────────────────────────

describe('WhatsAppService', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockFrom.mockClear();
    global.fetch = jest.fn();
  });

  describe('configuração', () => {
    it('não faz fetch quando credenciais não estão configuradas', async () => {
      const svc = await buildService(
        makeConfig({ WHATSAPP_PHONE_NUMBER_ID: undefined, WHATSAPP_ACCESS_TOKEN: undefined }),
      );
      await svc.sendMessage('11999999999', 'test');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('não faz fetch quando número é vazio após strip', async () => {
      const svc = await buildService();
      await svc.sendMessage('', 'test');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('envio com sucesso', () => {
    it('chama a Graph API da Meta com payload correto', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(META_SUCCESS);

      const svc = await buildService();
      await svc.sendMessage('11999999999', 'Olá!', 'profile-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v20.0/123456789/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
          body: expect.stringContaining('"messaging_product":"whatsapp"'),
        }),
      );
    });

    it('grava log com status "sent" e messageId correto', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(META_SUCCESS);

      const svc = await buildService();
      await svc.sendMessage('11999999999', 'Olá!', 'profile-1');

      expect(mockFrom).toHaveBeenCalledWith('whatsapp_send_log');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status:     'sent',
          message_id: 'wamid.abc123',
          phone:      '11999999999',
          profile_id: 'profile-1',
        }),
      );
    });

    it('remove não-dígitos do número antes de enviar', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(META_SUCCESS);

      const svc = await buildService();
      await svc.sendMessage('+55 (11) 99999-9999', 'test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: expect.stringContaining('"to":"5511999999999"') }),
      );
    });
  });

  describe('retry', () => {
    it('tenta 3 vezes em caso de falha HTTP e grava log com status "failed"', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const svc = await buildService();
      await svc.sendMessage('11999999999', 'Olá!');

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error: expect.stringContaining('500') }),
      );
    }, 15_000);

    it('não tenta mais após sucesso na segunda tentativa', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'Unavailable' })
        .mockResolvedValueOnce(META_SUCCESS);

      const svc = await buildService();
      await svc.sendMessage('11999999999', 'Olá!');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
    }, 10_000);
  });

  describe('rate limiting', () => {
    it('bloqueia segundo envio para o mesmo número dentro do cooldown', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(META_SUCCESS);

      const svc = await buildService();
      await svc.sendMessage('11999999999', 'primeiro');
      await svc.sendMessage('11999999999', 'segundo');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('permite envio para números diferentes sem bloqueio', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(META_SUCCESS);

      const svc = await buildService();
      await svc.sendMessage('11999999991', 'para número A');
      await svc.sendMessage('11999999992', 'para número B');

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
