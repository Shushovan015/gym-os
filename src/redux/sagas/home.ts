import type { SagaIterator } from "redux-saga";
import { call, put, takeLatest } from "redux-saga/effects";
import { GET_HOME_REQUEST, getHomeSuccess, getHomeFailure } from "@src/redux/actions/home";
import { fetchHome } from "@src/redux/services/home";

function* getHomeWorker(): SagaIterator {
  try {
    const data: any = yield call(fetchHome);
    yield put(getHomeSuccess(data));
  } catch (err: any) {
    yield put(getHomeFailure(err.message || "Failed to load home"));
  }
}

export default function* homeSaga(): SagaIterator {
  yield takeLatest(GET_HOME_REQUEST, getHomeWorker);
}
