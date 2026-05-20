import type { FinancialType, ChargeStatus } from '../constants/enums';

export interface FinancialRecord {
  id: string;
  type: FinancialType;
  amount: number;
  description?: string;
  category?: string;
  unit_id?: string;
  due_date?: string;
  paid_at?: string;
  payment_method?: string;
  gateway_id?: string;
  receipt_url?: string;
  condominium_id: string;
  created_by?: string;
  created_at: string;
}

export interface Charge {
  id: string;
  unit_id: string;
  profile_id?: string;
  description: string;
  amount: number;
  due_date: string;
  status: ChargeStatus;
  paid_at?: string;
  payment_method?: string;
  gateway_charge_id?: string;
  boleto_url?: string;
  pix_qr_code?: string;
  pix_key?: string;
  condominium_id: string;
  created_at: string;
}

export interface FinancialSummary {
  total_income: number;
  total_expense: number;
  balance: number;
  pending_charges: number;
  overdue_charges: number;
  overdue_units: string[];
}

// DTOs
export interface CreateFinancialRecordDto {
  type: FinancialType;
  amount: number;
  description: string;
  category?: string;
  unit_id?: string;
  due_date?: string;
}

export interface CreateChargeDto {
  unit_id: string;
  description: string;
  amount: number;
  due_date: string;
}
