import type { SagaIterator } from "redux-saga";
import { call, put, takeLatest } from "redux-saga/effects";
import {
  GET_CONTACT_REQUEST,
  getContactSuccess,
  getContactFailure,
} from "@src/redux/actions/contact";
import { fetchContact } from "@src/redux/services/contact";

function* getContactWorker(): SagaIterator {
  try {
    const data: any = yield call(fetchContact);
    yield put(getContactSuccess(data));
  } catch (err: any) {
    yield put(getContactFailure(err.message || "Failed to load contact page"));
  }
}

export default function* contactSaga(): SagaIterator {
  yield takeLatest(GET_CONTACT_REQUEST, getContactWorker);
}
