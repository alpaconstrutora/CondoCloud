import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

// Carregar .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const seedData = {
  condominium: {
    name: 'Residencial Aurora',
    address: 'Av. Paulista, 1000 — São Paulo/SP',
    cnpj: '12.345.678/0001-99',
    activated: true,
    onboarding_completed: true,
    subscription_status: 'active',
    plan: 'pro',
  },
  blocks: ['Bloco A', 'Bloco B', 'Bloco C'],
  units_per_block: 20,
  profiles: [
    { role: 'sindico', name: 'Carlos Mendes', email: 'sindico@aurora.com' },
    { role: 'morador', name: 'Ana Souza', email: 'ana@aurora.com', unit: 'A-101' },
    { role: 'morador', name: 'João Lima', email: 'joao@aurora.com', unit: 'B-205' },
    { role: 'morador', name: 'Maria Costa', email: 'maria@aurora.com', unit: 'C-312' },
    { role: 'prestador', name: 'Fix Rápido', email: 'fix@prestador.com' },
  ],
  tickets: [
    { title: 'Lâmpada queimada corredor B2', category: 'manutencao', priority: 'low', status: 'open' },
    { title: 'Barulho excessivo apto 304', category: 'barulho', priority: 'high', status: 'in_progress' },
    { title: 'Portão garagem com defeito', category: 'seguranca', priority: 'urgent', status: 'open' },
    { title: 'Infiltração corredor Bloco A', category: 'manutencao', priority: 'medium', status: 'resolved' },
  ],
  messages: [
    { title: 'Manutenção da piscina — sábado 9h', content: 'Prezados, a piscina estará em manutenção neste sábado.', audience: 'all', pinned: true },
    { title: 'Reunião de moradores Bloco A', content: 'Convocamos todos para a reunião...', audience: 'block', pinned: false },
  ],
  financial: [
    { type: 'income', amount: 45000, description: 'Taxas condominiais — Mai/2025', paid_at: '2025-05-05' },
    { type: 'expense', amount: 8500, description: 'Manutenção elevadores', paid_at: '2025-05-08' },
    { type: 'expense', amount: 3200, description: 'Conta de água', paid_at: '2025-05-12' },
  ],
  overdue_units: ['A-105', 'A-210', 'B-108'],
  common_areas: [
    { name: 'Salão de Festas', capacity: 80, min_advance_hours: 48, fee: 200 },
    { name: 'Churrasqueira', capacity: 30, min_advance_hours: 24, fee: 0 },
  ],
};

async function runSeed() {
  console.log('🌱 Iniciando seed dos dados...');

  try {
    // 1. Obter Plano "Pro"
    const { data: plans, error: planError } = await supabase.from('plans').select('*');
    if (planError) throw planError;
    
    let proPlan = plans.find((p) => p.name === 'pro');
    if (!proPlan) {
      console.log('Plano PRO não encontrado (as migrations rodaram?). Considerando NULL.');
    }

    // 2. Condomínio
    const { data: condo, error: condoError } = await supabase
      .from('condominiums')
      .insert({
        ...seedData.condominium,
        plan_id: proPlan?.id,
      })
      .select()
      .single();
    if (condoError) throw condoError;
    console.log(`✅ Condomínio criado: ${condo.name}`);

    // 3. Blocos e Unidades
    const blockIds: Record<string, string> = {};
    for (const blockName of seedData.blocks) {
      const { data: b, error } = await supabase
        .from('blocks')
        .insert({ name: blockName, condominium_id: condo.id })
        .select()
        .single();
      if (error) throw error;
      
      blockIds[blockName.charAt(blockName.length - 1)] = b.id; // 'Bloco A' => 'A'
      
      for (let i = 1; i <= seedData.units_per_block; i++) {
        const floor = Math.ceil(i / 5); // 5 por andar
        const num = `${floor}${i.toString().padStart(2, '0')}`;
        await supabase
          .from('units')
          .insert({ number: num, block_id: b.id, condominium_id: condo.id });
      }
    }
    console.log(`✅ Blocos e Unidades criados.`);

    // 4. Áreas comuns
    for (const area of seedData.common_areas) {
      await supabase.from('common_areas').insert({
        ...area,
        condominium_id: condo.id,
      });
    }
    console.log(`✅ Áreas comuns criadas.`);

    console.log('🎉 Seed completo! Dados básicos inseridos (usuários reais via Supabase Auth precisarão de registro/convite para popular os profiles).');
  } catch (error) {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  }
}

runSeed();
