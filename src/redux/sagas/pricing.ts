import { call, put, takeLatest } from "redux-saga/effects";
import {
  GET_PRICING_REQUEST,
  getPricingSuccess,
  getPricingFailure,
} from "@src/redux/actions/pricing";
import { fetchPricing } from "@src/redux/services/pricing";

function* getPricingWorker() {
  try {
    const data: any[] = yield call(fetchPricing);
    yield put(getPricingSuccess(data));
  } catch (err: any) {
    yield put(getPricingFailure(err.message || "Failed to load pricing"));
  }
}

export default function* pricingSaga() {
  yield takeLatest(GET_PRICING_REQUEST, getPricingWorker);
}
