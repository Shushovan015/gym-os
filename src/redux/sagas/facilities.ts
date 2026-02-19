import { call, put, takeLatest } from "redux-saga/effects";
import {
  GET_FACILITIES_REQUEST,
  getFacilitiesSuccess,
  getFacilitiesFailure,
} from "@src/redux/actions/facilities";
import { fetchFacilities } from "@src/redux/services/facilities";

function* getFacilitiesWorker() {
  try {
    const data: any[] = yield call(fetchFacilities);
    yield put(getFacilitiesSuccess(data));
  } catch (err: any) {
    yield put(getFacilitiesFailure(err.message || "Failed to load facilities"));
  }
}

export default function* facilitiesSaga() {
  yield takeLatest(GET_FACILITIES_REQUEST, getFacilitiesWorker);
}
