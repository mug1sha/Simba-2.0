export type UserRole = "customer" | "branch_manager" | "branch_staff";

export const getRoleDashboardPath = (role?: UserRole | null) => {
  switch (role) {
    case "branch_manager":
      return "/branch/manager";
    case "branch_staff":
      return "/branch/staff";
    case "customer":
    default:
      return "/customer";
  }
};
