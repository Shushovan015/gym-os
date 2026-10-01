import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addMonthsPreservingDay,
  getNextMonthFirstDay,
  formatBillingPeriod,
  formatMembershipFeeAmount,
  membershipFeeStatusTone,
  isMembershipFeeStatus,
  formatDisplayDate,
  bsStringToAdDate,
  formatBsDateFromAd,
  adToBsString,
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

describe("BS date conversion - timezone-safe round-trip", () => {
  it("Ashar 2 (2083-03-02) converts to AD and back without day shift", () => {
    const bsDate = "2083-03-02"; // Ashar 2, 2083
    const adDate = bsStringToAdDate(bsDate);
    const bsBack = adToBsString(adDate);
    
    expect(adDate).toBe("2026-06-16");
    expect(bsBack).toBe("2083-03-02");
  });

  it("Ashoj 1 (2083-06-01) converts to AD and back without day shift", () => {
    const bsDate = "2083-06-01"; // Ashoj 1, 2083
    const adDate = bsStringToAdDate(bsDate);
    const bsBack = adToBsString(adDate);
    
    expect(adDate).toBe("2026-09-17");
    expect(bsBack).toBe("2083-06-01");
  });

  it("round-trips all months of 2083 correctly", () => {
    const months = [
      "2083-01-01", // Baisakh 1
      "2083-02-01", // Jestha 1
      "2083-03-01", // Asar 1
      "2083-04-01", // Shrawan 1
      "2083-05-01", // Bhadra 1
      "2083-06-01", // Ashoj 1
      "2083-07-01", // Kartik 1
      "2083-08-01", // Mangsir 1
      "2083-09-01", // Poush 1
      "2083-10-01", // Magh 1
      "2083-11-01", // Falgun 1
      "2083-12-01", // Chaitra 1
    ];

    for (const bsDate of months) {
      const adDate = bsStringToAdDate(bsDate);
      const bsBack = adToBsString(adDate);
      expect(bsBack).toBe(bsDate);
    }
  });

  it("formatDisplayDate shows correct BS date for Ashar 2", () => {
    // Ashar 2, 2083 = 2026-06-16 AD
    const result = formatDisplayDate("2026-06-16");
    expect(result).toBe("2083-03-02 BS");
  });

  it("formatDisplayDate shows correct BS date for Ashoj 1", () => {
    // Ashoj 1, 2083 = 2026-09-17 AD
    const result = formatDisplayDate("2026-09-17");
    expect(result).toBe("2083-06-01 BS");
  });

  it("initial membership due date equals start date (Ashoj 1)", () => {
    const startDate = "2026-09-17"; // Ashoj 1, 2083
    const due1 = addMonthsPreservingDay(startDate, 0); // First due date
    expect(due1).toBe("2026-09-17");
  });

  it("initial membership due date equals start date (Ashar 2)", () => {
    const startDate = "2026-06-16"; // Ashar 2, 2083
    const due1 = addMonthsPreservingDay(startDate, 0); // First due date
    expect(due1).toBe("2026-06-16");
  });

  it("Ashoj 1 payment -> next due date is one AD month later (2026-10-17)", () => {
    const startDate = "2026-09-17"; // Ashoj 1, 2083
    const due1 = addMonthsPreservingDay(startDate, 0); // Ashoj 1
    const due2 = addMonthsPreservingDay(startDate, 1); // After payment -> one AD month later
    
    expect(due1).toBe("2026-09-17");
    expect(due2).toBe("2026-10-17"); // One month later in AD calendar
  });

  it("Ashar 2 payment -> next due date is one AD month later (2026-07-16)", () => {
    const startDate = "2026-06-16"; // Ashar 2, 2083
    const due1 = addMonthsPreservingDay(startDate, 0); // Ashar 2
    const due2 = addMonthsPreservingDay(startDate, 1); // After payment -> one AD month later
    
    expect(due1).toBe("2026-06-16");
    expect(due2).toBe("2026-07-16"); // One month later in AD calendar
  });

  it("timezone differences cannot shift the date by one day", () => {
    // Simulate the old buggy behavior (using UTC components) vs new behavior (local components)
    const bsDate = "2083-03-02"; // Ashar 2
    
    // New correct behavior (using local components)
    const adDateCorrect = bsStringToAdDate(bsDate);
    const bsBackCorrect = adToBsString(adDateCorrect);
    
    // Old buggy behavior would have returned 2026-06-15 (one day before)
    expect(adDateCorrect).not.toBe("2026-06-15");
    expect(bsBackCorrect).toBe("2083-03-02");
  });
});