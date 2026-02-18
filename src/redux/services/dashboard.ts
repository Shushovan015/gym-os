export const getDashboardData = async () => {
  return new Promise<{ data: any }>((resolve) => {
    setTimeout(() => {
      resolve({
        data: {
          message: "Dashboard loaded from service ✅",
          streak: 3,
          workoutsThisWeek: 4,
        },
      });
    }, 400);
  });
};
