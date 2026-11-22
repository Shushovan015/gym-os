import { namePrefixPattern, normalizeNameSearch } from "./nameSearch";

const names = ["Suman Sharma", "Ram Shrestha", "Tirtha Budha", "Tirtha   Sagar Budha", "  Oprah O'Neil  "];
const find = (search: string) => {
  const pattern = namePrefixPattern(search).replaceAll("[[:space:]]", "\\s").replaceAll("[^[:space:]]", "\\S");
  return names.filter((name) => new RegExp(pattern, "i").test(name));
};

it("normalizes whitespace and matches case-insensitive first- or last-name prefixes only", () => {
  expect(normalizeNameSearch("   Ram\t Shrestha  ")).toBe("Ram Shrestha");
  expect(find(" s ")).toEqual(["Suman Sharma", "Ram Shrestha"]);
  expect(find("  tIrThA  bu ")).toEqual(["Tirtha Budha"]);
  expect(find("O'ne")).toEqual(["  Oprah O'Neil  "]);
  expect(find("irth")).toEqual([]);
  expect(find(".*")).toEqual([]);
  expect(find("s|t")).toEqual([]);
});
