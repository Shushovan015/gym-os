import { beforeEach, expect, it, vi } from 'vitest';
import { runLegacyImport } from './migrationService';

const client = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock('@src/Client/supabase', () => ({
  supabase: { auth: { getUser: client.getUser }, rpc: client.rpc, from: client.from },
}));

beforeEach(() => vi.resetAllMocks());

const input = { fileName: 'members.sql', sqlContent: '' };

it('requires a signed-in administrator instead of asking for an ID', async () => {
  client.getUser.mockResolvedValue({ data: { user: null }, error: null });

  await expect(runLegacyImport(input)).rejects.toThrow('Sign in as an administrator');
  expect(client.rpc).not.toHaveBeenCalled();
  expect(client.from).not.toHaveBeenCalled();
});

it('stops before importing any records when the database migration is missing', async () => {
  client.getUser.mockResolvedValue({ data: { user: { id: 'signed-in-user' } }, error: null });
  client.rpc.mockResolvedValue({ error: { code: 'PGRST202' } });

  await expect(runLegacyImport(input)).rejects.toThrow('database update is missing');
  expect(client.rpc).toHaveBeenCalledWith('import_legacy_bill', { p_invoice: null });
  expect(client.from).not.toHaveBeenCalled();
});
