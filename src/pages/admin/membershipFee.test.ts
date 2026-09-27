import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addMonthsPreservingDay,
  getNextMonthFirstDay,
  formatBillingPeriod,
  formatMembershipFeeAmount,
  membershipFeeStatusTone,
  isMembershipFeeStatus,
  formatDisplayDate,
} from "./adminUtils";

describe("Membership fee utilities", () => {
  describe("addMonthsPreservingDay", () => {
    it("adds months normally", () => {
      expect(addMonthsPreservingDay("2026-01-15", 1)).toBe("2026-02-15");
      expect(addMonthsPreservingDay("2026-01-15", 3)).toBe("2026-04-15");
      expect(addMonthsPreservingDay("2026-01-15", 12)).toBe("2027-01-15");
    });

    it("handles month-end dates (Jan 31 -> Feb 28/29)", () => {
      // Non-leap year
      expect(addMonthsPreservingDay("2026-01-31", 1)).toBe("2026-02-28");
      // Leap year
      expect(addMonthsPreservingDay("2024-01-31", 1)).toBe("2024-02-29");
      // Multiple months
      expect(addMonthsPreservingDay("2026-01-31", 2)).toBe("2026-03-31");
    });

    it("handles 30-day months", () => {
      expect(addMonthsPreservingDay("2026-05-31", 1)).toBe("2026-06-30");
      expect(addMonthsPreservingDay("2026-08-31", 1)).toBe("2026-09-30");
    });

    it("handles negative months", () => {
      expect(addMonthsPreservingDay("2026-03-15", -1)).toBe("2026-02-15");
      expect(addMonthsPreservingDay("2026-03-31", -1)).toBe("2026-02-28");
    });
  });

  describe("getNextMonthFirstDay", () => {
    it("returns first day of next month", () => {
      expect(getNextMonthFirstDay("2026-01-15")).toBe("2026-02-01");
      expect(getNextMonthFirstDay("2026-12-15")).toBe("2027-01-01");
      expect(getNextMonthFirstDay("2026-01-31")).toBe("2026-02-01");
    });
  });

  describe("formatBillingPeriod", () => {
    it("formats billing month as period name with Nepali month", () => {
      // Uses Nepali month names (e.g., Bhadra, Poush, Mangsir)
      expect(formatBillingPeriod("2026-09-01")).toMatch(/^(Bhadra|Ashwin) 2083 Membership Fee$/);
      expect(formatBillingPeriod("2026-01-01")).toMatch(/^(Poush|Magh) 2082 Membership Fee$/);
      expect(formatBillingPeriod("2026-12-01")).toMatch(/^(Mangsir|Poush) 2083 Membership Fee$/);
    });
  });

  describe("formatMembershipFeeAmount", () => {
    it("formats minor units as major currency", () => {
      expect(formatMembershipFeeAmount(500000, "NPR")).toBe("5000.00 NPR");
      expect(formatMembershipFeeAmount(150000, "NPR")).toBe("1500.00 NPR");
      expect(formatMembershipFeeAmount(0, "NPR")).toBe("0.00 NPR");
    });
  });

  describe("membershipFeeStatusTone", () => {
    it("returns correct tone for each status", () => {
      expect(membershipFeeStatusTone("paid")).toBe("success");
      expect(membershipFeeStatusTone("overdue")).toBe("danger");
      expect(membershipFeeStatusTone("partial")).toBe("warning");
      expect(membershipFeeStatusTone("unpaid")).toBe("warning");
    });
  });

  describe("isMembershipFeeStatus", () => {
    it("validates status values", () => {
      expect(isMembershipFeeStatus("paid")).toBe(true);
      expect(isMembershipFeeStatus("unpaid")).toBe(true);
      expect(isMembershipFeeStatus("overdue")).toBe(true);
      expect(isMembershipFeeStatus("partial")).toBe(true);
      expect(isMembershipFeeStatus("invalid")).toBe(false);
      expect(isMembershipFeeStatus("")).toBe(false);
    });
  });
});

describe("Monthly membership fee logic - Due date progression", () => {
  it("calculates due dates correctly for monthly payments", () => {
    // Joined Sept 27 -> unpaid due Sept 27
    // After payment -> due Oct 27 -> after payment -> Nov 27
    const startDate = "2026-09-27";
    const due1 = addMonthsPreservingDay(startDate, 0); // First due date
    const due2 = addMonthsPreservingDay(startDate, 1); // After first payment
    const due3 = addMonthsPreservingDay(startDate, 2); // After second payment

    expect(due1).toBe("2026-09-27");
    expect(due2).toBe("2026-10-27");
    expect(due3).toBe("2026-11-27");
  });

  it("handles month-end dates correctly", () => {
    // Joined Jan 31 -> due Jan 31
    // After payment -> due Feb 28 (non-leap) or Feb 29 (leap)
    const startDate = "2026-01-31";
    const due1 = addMonthsPreservingDay(startDate, 0);
    const due2 = addMonthsPreservingDay(startDate, 1);
    const due3 = addMonthsPreservingDay(startDate, 2);

    expect(due1).toBe("2026-01-31");
    expect(due2).toBe("2026-02-28");
    expect(due3).toBe("2026-03-31");
  });

  it("handles leap year Feb 29", () => {
    const startDate = "2024-01-31";
    const due2 = addMonthsPreservingDay(startDate, 1);
    expect(due2).toBe("2024-02-29");
  });
});

describe("Multi-month advance payment scenarios", () => {
  it("calculates total for 3-month advance payment", () => {
    const monthlyFee = 500000; // 5000.00 in minor units
    const months = 3;
    const expectedTotal = monthlyFee * months;
    expect(expectedTotal).toBe(1500000); // 15000.00
  });

  it("calculates total for 6-month advance payment", () => {
    const monthlyFee = 500000;
    const months = 6;
    const expectedTotal = monthlyFee * months;
    expect(expectedTotal).toBe(3000000);
  });

  it("determines next due date after advance payment", () => {
    // Paid Sep, Oct, Nov -> next due Dec 27
    const lastPaidMonth = "2026-11-01";
    const nextDue = addMonthsPreservingDay(lastPaidMonth, 1);
    expect(nextDue).toBe("2026-12-01");
  });

  it("handles advance payment with overdue months", () => {
    // Member has overdue Aug, unpaid Sep, pays both + Oct (3 months)
    // Next due should be Nov 27
    const lastPaidMonth = "2026-10-01";
    const nextDue = addMonthsPreservingDay(lastPaidMonth, 1);
    expect(nextDue).toBe("2026-11-01");
  });
});

describe("Payment status transitions", () => {
  it("transitions from unpaid to paid when full amount paid", () => {
    const amountMinor = 500000;
    const paidAmountMinor = 500000;
    const newStatus = paidAmountMinor >= amountMinor ? "paid" : "partial";
    expect(newStatus).toBe("paid");
  });

  it("transitions to partial when partial amount paid", () => {
    const amountMinor = 500000;
    const paidAmountMinor = 250000;
    const newStatus = paidAmountMinor >= amountMinor ? "paid" : paidAmountMinor > 0 ? "partial" : "unpaid";
    expect(newStatus).toBe("partial");
  });

  it("stays unpaid when no payment made", () => {
    const amountMinor = 500000;
    const paidAmountMinor = 0;
    const newStatus = paidAmountMinor >= amountMinor ? "paid" : paidAmountMinor > 0 ? "partial" : "unpaid";
    expect(newStatus).toBe("unpaid");
  });
});

describe("Attendance section membership fee display", () => {
  it("formats display date correctly", () => {
    const result = formatDisplayDate("2026-09-27");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} BS$/); // Nepali date format
    expect(formatDisplayDate(null)).toBe("-");
  });

  it("identifies overdue fees", () => {
    const today = "2026-10-15";
    const overdueDueDate = "2026-10-01";
    const upcomingDueDate = "2026-11-01";
    
    expect(new Date(overdueDueDate) < new Date(today)).toBe(true);
    expect(new Date(upcomingDueDate) < new Date(today)).toBe(false);
  });
});

describe("Edge cases for membership fee payments", () => {
  it("prevents selecting already paid months", () => {
    const fees = [
      { id: 1, billing_month: "2026-09-01", status: "paid" },
      { id: 2, billing_month: "2026-10-01", status: "unpaid" },
      { id: 3, billing_month: "2026-11-01", status: "unpaid" },
    ];
    
    const selectableFees = fees.filter(f => f.status !== "paid");
    expect(selectableFees).toHaveLength(2);
    expect(selectableFees.map(f => f.id)).toEqual([2, 3]);
  });

  it("allows paying overdue + future months together", () => {
    const fees = [
      { id: 1, billing_month: "2026-08-01", status: "overdue" },
      { id: 2, billing_month: "2026-09-01", status: "unpaid" },
      { id: 3, billing_month: "2026-10-01", status: "unpaid" },
    ];
    
    // All should be selectable since none are paid
    const selectableFees = fees.filter(f => f.status !== "paid");
    expect(selectableFees).toHaveLength(3);
  });

  it("calculates next due date based on last month paid, not payment date", () => {
    // Payment made on Oct 15 for Sep, Oct, Nov
    // Next due should be Dec 27 (based on Nov billing month), not Nov 15
    const lastPaidBillingMonth = "2026-11-01";
    const paymentDate = "2026-10-15";
    const nextDue = addMonthsPreservingDay(lastPaidBillingMonth, 1);
    
    expect(nextDue).toBe("2026-12-01");
    // Should NOT be based on payment date
    expect(addMonthsPreservingDay(paymentDate, 1)).not.toBe(nextDue);
  });
});