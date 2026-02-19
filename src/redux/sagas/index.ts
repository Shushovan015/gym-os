import { all, fork } from "redux-saga/effects";
import dashboardWatcher from "./dashboard";
import testimonialsSaga from "./testimonials";
import trainersSaga from "./trainers";
import facilitiesSaga from "./facilities";
import pricingSaga from "./pricing";
import footerSaga from "./footer"
import contactSaga from "./contact";
import homeSaga from "./home";


export default function* rootSaga() {
  yield all([
    fork(dashboardWatcher),
    fork(testimonialsSaga),
    fork(trainersSaga),
    fork(facilitiesSaga),
    fork(pricingSaga),
    fork(footerSaga),
    fork(contactSaga),
    fork(homeSaga),
  ]);
}
