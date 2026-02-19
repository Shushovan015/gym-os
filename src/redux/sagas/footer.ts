import type { SagaIterator } from "redux-saga";
import { call, put, takeLatest } from "redux-saga/effects";
import {
  GET_FOOTER_REQUEST,
  getFooterSuccess,
  getFooterFailure,
} from "@src/redux/actions/footer";
import { fetchFooter } from "@src/redux/services/footer";

function* getFooterWorker(): SagaIterator {
  try {
    const data: any = yield call(fetchFooter);
    yield put(getFooterSuccess(data));
  } catch (err: any) {
    yield put(getFooterFailure(err.message || "Failed to load footer"));
  }
}

export default function* footerSaga(): SagaIterator {
  yield takeLatest(GET_FOOTER_REQUEST, getFooterWorker);
}
