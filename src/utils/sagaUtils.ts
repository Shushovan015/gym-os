import { put } from "redux-saga/effects";
import loaderActions from "@Actions/loader";

export default function withLoader(worker: any) {
  return function* wrappedWorker(action: any) {
    try {
      yield put(loaderActions.loaderShow());
      yield* worker(action);
    } finally {
      yield put(loaderActions.loaderHide());
    }
  };
}
