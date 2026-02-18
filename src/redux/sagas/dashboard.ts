import { call, put, takeLatest } from "redux-saga/effects";
import dashboardActions, { Types } from "@Actions/dashboard";
import { getDashboardData } from "@Services/dashboard";

export function* getDashboardRequest(action: any) {
  try {
    const response: { data: any } = yield call(getDashboardData);
    yield put(dashboardActions.getDashboardSuccess({ data: response.data }));
  } catch (err) {
    yield put(dashboardActions.getDashboardFailure());
  }
}

export default function* dashboardWatcher() {
  yield takeLatest(Types.GET_DASHBOARD_REQUEST, getDashboardRequest);
}
