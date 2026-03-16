/**
 * tasks.ts
 * CRUD operations for the tasks table.
 */

import { getSupabase } from "./client";
import type { TaskStatus } from "./types";

export interface TaskRecord {
  id: string;
  payment_request_id: string;
  from_agent_wallet: string;
  to_human_wallet: string;
  task_description: string;
  amount_usdc: number;
  deadline_unix: number;
  status: TaskStatus;
  tx_hash: string | null;
  escrow_contract: string | null;
  created_at: string;
}

export interface CreateTaskInput {
  payment_request_id: string;
  from_agent_wallet: string;
  to_human_wallet: string;
  task_description: string;
  amount_usdc: number;
  deadline_unix: number;
  tx_hash: string;
  escrow_contract: string;
}

export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      payment_request_id: input.payment_request_id,
      from_agent_wallet: input.from_agent_wallet,
      to_human_wallet: input.to_human_wallet,
      task_description: input.task_description,
      amount_usdc: input.amount_usdc,
      deadline_unix: input.deadline_unix,
      tx_hash: input.tx_hash,
      escrow_contract: input.escrow_contract,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(`createTask failed: ${error.message}`);
  return data as TaskRecord;
}

export async function getTaskByPaymentId(
  paymentRequestId: string,
): Promise<TaskRecord | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("tasks")
    .select()
    .eq("payment_request_id", paymentRequestId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`getTaskByPaymentId failed: ${error.message}`);
  }
  return (data as TaskRecord) ?? null;
}

export async function updateTaskStatus(
  paymentRequestId: string,
  status: TaskStatus,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("payment_request_id", paymentRequestId);

  if (error) throw new Error(`updateTaskStatus failed: ${error.message}`);
}
