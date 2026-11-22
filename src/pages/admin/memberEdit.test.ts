import { describe, expect, it } from "vitest";
import type { MemberRow } from "./adminTypes";
import { emptyMemberForm, validateMemberForm } from "./adminUtils";

const form = {
  ...emptyMemberForm,
  member_id: "LEG-001",
  full_name: "Sample Member",
  phone: "9800000000",
  email: "sample@example.com",
};

const member: MemberRow = {
  ...form,
  id: 1,
  created_at: "2020-01-01",
  updated_at: "2020-01-01",
  deleted_at: null,
  is_active: true,
  activated_at: null,
  deactivated_at: null,
};
const sharedContact = { ...member, id: 2, member_id: "LEG-002" };
const otherContact = { ...member, id: 3, member_id: "LEG-003", phone: "9811111111", email: "other@example.com" };

describe("editing imported members", () => {
  it("allows profile updates when existing contact details are shared", () => {
    expect(validateMemberForm({ ...form, notes: "Updated" }, [member, sharedContact], member)).toEqual({});
  });

  it("rejects changing fields to values used by another member", () => {
    const changes = { ...form, member_id: otherContact.member_id, phone: otherContact.phone, email: "OTHER@example.com" };
    expect(Object.keys(validateMemberForm(changes, [member, otherContact], member))).toEqual(["member_id", "phone", "email"]);
  });

  it("still rejects duplicate contact details on creation", () => {
    const errors = validateMemberForm({ ...form, member_id: "NEW-001" }, [member], null);
    expect(Object.keys(errors)).toEqual(["phone", "email"]);
  });
});
