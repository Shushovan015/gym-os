import { all, fork } from "redux-saga/effects";
import dashboardWatcher from "./dashboard";

export default function* rootSaga() {
  yield all([fork(dashboardWatcher)]);
}
