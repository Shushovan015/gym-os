import { call, put, takeLatest } from "redux-saga/effects";
import {
  GET_PROSHOP_REQUEST,
  getProShopSuccess,
  getProShopFailure,
} from "@src/redux/actions/proShop";
import { fetchProShop } from "@src/redux/services/proShop";

function* getProShopWorker() {
  try {
    const data: any[] = yield call(fetchProShop);
    yield put(getProShopSuccess(data));
  } catch (err: any) {
    yield put(getProShopFailure(err.message || "Failed to load pro shop"));
  }
}

export default function* proShopSaga() {
  yield takeLatest(GET_PROSHOP_REQUEST, getProShopWorker);
}
