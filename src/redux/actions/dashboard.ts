import { createActions } from "reduxsauce";

export const { Types, Creators } = createActions({
  getDashboardRequest: ["payload"],
  getDashboardSuccess: ["payload"],
  getDashboardFailure: null,

  setDashboardFilter: ["payload"],
});

export default Creators;
