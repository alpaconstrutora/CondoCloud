import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { EventEmitterService } from '../../events/event-emitter.service';
import { DOMAIN_EVENTS } from '@condocloud/shared';
import type { Profile } from '@condocloud/shared';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async signup(dto: SignupDto): Promise<{ access_token: string; refresh_token: string; profile: Profile }> {
    const admin = this.supabaseService.getAdminClient();

    // Criar usuário no Supabase Auth (trigger cria o profile automaticamente)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true, // confirmar automaticamente no MVP
      user_metadata: { role: 'sindico', name: dto.name },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new ConflictException('Email já cadastrado');
      }
      throw new Error(authError.message);
    }

    const userId = authData.user.id;

    // Criar condomínio placeholder (dados reais vêm no Onboarding Step 1)
    const { data: condo, error: condoError } = await admin
      .from('condominiums')
      .insert({ name: 'Meu Condomínio', activated: false, onboarding_completed: false })
      .select()
      .single();

    if (condoError) throw new Error(condoError.message);

    // Atualizar profile com name e condominium_id
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .update({ name: dto.name, condominium_id: condo.id, role: 'sindico' })
      .eq('id', userId)
      .select()
      .single();

    if (profileError) throw new Error(profileError.message);

    // Emitir evento de domínio
    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.USER_REGISTERED,
      aggregate_id: userId,
      aggregate_type: 'profile',
      event_version: 1,
      source: 'api',
      condo_id: condo.id,
      payload: { role: 'sindico', condominium_id: condo.id },
    });

    // Gerar sessão para o usuário recém-criado
    const { data: session, error: sessionError } = await this.supabaseService
      .getAnonClient()
      .auth.signInWithPassword({ email: dto.email, password: dto.password });

    if (sessionError || !session.session) throw new UnauthorizedException('Erro ao iniciar sessão');

    return {
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
      profile: profile as Profile,
    };
  }

  async login(dto: LoginDto): Promise<{ access_token: string; refresh_token: string; profile: Profile }> {
    const { data, error } = await this.supabaseService
      .getAnonClient()
      .auth.signInWithPassword({ email: dto.email, password: dto.password });

    if (error || !data.session) {
      throw new UnauthorizedException('Email ou senha incorretos');
    }

    const { data: profile } = await this.supabaseService
      .getAdminClient()
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      profile: profile as Profile,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const { data, error } = await this.supabaseService
      .getAnonClient()
      .auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };
  }

  async listProfiles(condoId: string): Promise<Profile[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('profiles')
      .select('*, units!unit_id(number, blocks(name))')
      .eq('condominium_id', condoId)
      .order('name');
    return (data ?? []) as unknown as Profile[];
  }

  async getProfileById(condoId: string, profileId: string): Promise<Profile> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('profiles')
      .select('*, units!unit_id(number, blocks(name))')
      .eq('id', profileId)
      .eq('condominium_id', condoId)
      .single();
    if (error || !data) throw new Error('Perfil não encontrado');
    return data as unknown as Profile;
  }

  async updateProfile(userId: string, dto: Record<string, unknown>): Promise<Profile> {
    const allowed = ['name', 'phone', 'push_token'];
    const patch = Object.fromEntries(Object.entries(dto).filter(([k]) => allowed.includes(k)));
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Erro ao atualizar perfil');
    return data as unknown as Profile;
  }

  async updateProfileById(condoId: string, profileId: string, dto: Record<string, unknown>): Promise<Profile> {
    const allowed = ['name', 'phone', 'whatsapp', 'whatsapp_opt_in', 'role', 'unit_id', 'active', 'tipo_morador'];
    const patch = Object.fromEntries(Object.entries(dto).filter(([k]) => allowed.includes(k)));
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('profiles')
      .update(patch)
      .eq('id', profileId)
      .eq('condominium_id', condoId)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Erro ao atualizar morador');
    return data as unknown as Profile;
  }

  async deleteProfile(condoId: string, profileId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getAdminClient()
      .from('profiles')
      .update({ active: false, condominium_id: null })
      .eq('id', profileId)
      .eq('condominium_id', condoId);
    if (error) throw new Error(error.message);
  }

  async createResident(
    condoId: string,
    dto: { name: string; email?: string; phone?: string; role: string; unit_id?: string; tipo_morador?: string },
  ): Promise<{ profile: Profile; temporary_password: string }> {
    const admin = this.supabaseService.getAdminClient();

    // Gera e-mail automático se não fornecido
    const email = dto.email || `resident_${Date.now()}@condocloud.local`;

    // Gera senha temporária aleatória
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

    // Cria usuário no Supabase
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: dto.name },
    });

    if (authError) throw new Error(authError.message);

    // Atualiza profile criado automaticamente pelo trigger
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .update({
        email,
        name: dto.name,
        phone: dto.phone || null,
        role: dto.role,
        tipo_morador: dto.tipo_morador || null,
        condominium_id: condoId,
        unit_id: dto.unit_id || null,
        active: true,
      })
      .eq('id', authData.user.id)
      .select()
      .single();

    if (profileError) throw new Error(profileError.message);

    // Emite evento de forma assíncrona para não bloquear a resposta HTTP
    const eventRole = dto.role === 'sindico' ? 'sindico' : 'morador';
    this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.USER_REGISTERED,
      aggregate_id: authData.user.id,
      aggregate_type: 'profile',
      event_version: 1,
      source: 'api',
      condo_id: condoId,
      payload: { role: eventRole, condominium_id: condoId },
    }).catch((err: unknown) => this.logger.error('Falha ao emitir USER_REGISTERED', err));

    return {
      profile: profile as unknown as Profile,
      temporary_password: tempPassword,
    };
  }

  async getMyCondominiums(userId: string, role: string): Promise<unknown[]> {
    const admin = this.supabaseService.getAdminClient();

    if (role === 'desenvolvedor') {
      const { data } = await admin
        .from('condominiums')
        .select('*')
        .order('name');
      return data ?? [];
    }

    if (role === 'sindico_administradora') {
      const { data } = await admin
        .from('administradora_condominios')
        .select('condominium_id, condominiums(*)')
        .eq('profile_id', userId)
        .order('created_at');
      return (data ?? []).map((r: Record<string, unknown>) => r['condominiums']);
    }

    return [];
  }

  async linkCondominiumToAdm(profileId: string, condominiumId: string): Promise<void> {
    const { error } = await this.supabaseService.getAdminClient()
      .from('administradora_condominios')
      .insert({ profile_id: profileId, condominium_id: condominiumId });
    if (error) throw new Error(error.message);
  }

  async unlinkCondominiumFromAdm(profileId: string, condominiumId: string): Promise<void> {
    const { error } = await this.supabaseService.getAdminClient()
      .from('administradora_condominios')
      .delete()
      .eq('profile_id', profileId)
      .eq('condominium_id', condominiumId);
    if (error) throw new Error(error.message);
  }

  async reclaimSindico(userId: string): Promise<Profile> {
    const admin = this.supabaseService.getAdminClient();

    const { data: profile } = await admin
      .from('profiles')
      .select('condominium_id, role')
      .eq('id', userId)
      .single();

    if (!profile) throw new UnauthorizedException();
    if ((profile as { role: string }).role === 'sindico') return profile as unknown as Profile;

    // Só permite se não há outro síndico ativo no mesmo condomínio
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('condominium_id', (profile as { condominium_id: string }).condominium_id)
      .eq('role', 'sindico')
      .neq('id', userId)
      .maybeSingle();

    if (existing) throw new BadRequestException('Este condomínio já possui um síndico ativo.');

    const { data: updated, error } = await admin
      .from('profiles')
      .update({ role: 'sindico' })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated as unknown as Profile;
  }

  async getMe(userId: string): Promise<Profile> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('profiles')
      .select('*, units!unit_profiles(*), condominiums(*)')
      .eq('id', userId)
      .single();

    if (error || !data) throw new UnauthorizedException();

    return data as unknown as Profile;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const admin = this.supabaseService.getAdminClient();

    // Fetch email to verify current password via sign-in
    const { data: profile } = await admin.from('profiles').select('email').eq('id', userId).single();
    if (!profile) throw new UnauthorizedException();

    const email = (profile as { email: string }).email;
    const { error: signInError } = await this.supabaseService
      .getAnonClient()
      .auth.signInWithPassword({ email, password: currentPassword });

    if (signInError) throw new BadRequestException('Senha atual incorreta');

    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) throw new Error(error.message);
  }
}
