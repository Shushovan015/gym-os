import { call, put, takeLatest } from "redux-saga/effects";
import dashboardActions, { Types } from "@Actions/dashboard";
import toastActions from "@Actions/toast";
import withLoader from "@src/utils/sagaUtils";
import { getDashboardData } from "@Services/dashboard";

export function* getDashboardRequest(_action: any) {
  try {
    const response: { data: any } = yield call(getDashboardData);
    yield put(dashboardActions.getDashboardSuccess({ data: response.data }));
    yield put(toastActions.toastSuccess({ message: "Dashboard loaded ✅" }));
  } catch (err) {
    yield put(dashboardActions.getDashboardFailure());
    yield put(toastActions.toastError({ message: "Dashboard failed to load ❌" }));
  }
}

export default function* dashboardWatcher() {
  yield takeLatest(Types.GET_DASHBOARD_REQUEST, withLoader(getDashboardRequest));
}
