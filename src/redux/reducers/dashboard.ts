import { createReducer } from "reduxsauce";
import { Types } from "@Actions/dashboard";

export type DashboardStatus = "idle" | "loading" | "success" | "error";

export type DashboardState = {
  status: DashboardStatus;
  data: any;
  error: string | null;
  filter: string;
};

const initialState: DashboardState = {
  status: "idle",
  data: null,
  error: null,
  filter: "weekly",
};

const getDashboardRequest = (state: DashboardState): DashboardState => ({
  ...state,
  status: "loading",
  error: null,
});

const getDashboardSuccess = (state: DashboardState, action: any): DashboardState => {
  const {
    payload: { data },
  } = action;

  return {
    ...state,
    status: "success",
    data,
    error: null,
  };
};

const getDashboardFailure = (state: DashboardState): DashboardState => ({
  ...state,
  status: "error",
  error: "Failed to load dashboard",
});

const setDashboardFilter = (state: DashboardState, action: any): DashboardState => {
  const {
    payload: { filter },
  } = action;

  return {
    ...state,
    filter,
  };
};

const dashboardReducer = createReducer<DashboardState>(initialState, {
  [Types.GET_DASHBOARD_REQUEST]: getDashboardRequest,
  [Types.GET_DASHBOARD_SUCCESS]: getDashboardSuccess,
  [Types.GET_DASHBOARD_FAILURE]: getDashboardFailure,
  [Types.SET_DASHBOARD_FILTER]: setDashboardFilter,
});

export default dashboardReducer;
