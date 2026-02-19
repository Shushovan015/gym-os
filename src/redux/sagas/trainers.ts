import { call, put, takeLatest } from "redux-saga/effects";
import {
  GET_TRAINERS_REQUEST,
  getTrainersSuccess,
  getTrainersFailure,
} from "@src/redux/actions/trainers";
import { fetchTrainers } from "@src/redux/services/trainers";

function* getTrainersWorker() {
  try {
    const data: any[] = yield call(fetchTrainers);
    yield put(getTrainersSuccess(data));
  } catch (err: any) {
    yield put(getTrainersFailure(err.message || "Failed to load trainers"));
  }
}

export default function* trainersSaga() {
  yield takeLatest(GET_TRAINERS_REQUEST, getTrainersWorker);
}
