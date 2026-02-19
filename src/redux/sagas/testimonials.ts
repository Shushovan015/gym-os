import { call, put, takeLatest } from "redux-saga/effects";
import {
  GET_TESTIMONIALS_REQUEST,
  getTestimonialsSuccess,
  getTestimonialsFailure,
} from "@src/redux/actions/testimonials";
import { fetchTestimonials } from "@src/redux/services/testimonials";

function* getTestimonialsWorker() {
  try {
    const data: any[] = yield call(fetchTestimonials);
    yield put(getTestimonialsSuccess(data));
  } catch (err: any) {
    yield put(getTestimonialsFailure(err.message || "Failed to load testimonials"));
  }
}

export default function* testimonialsSaga() {
  yield takeLatest(GET_TESTIMONIALS_REQUEST, getTestimonialsWorker);
}
