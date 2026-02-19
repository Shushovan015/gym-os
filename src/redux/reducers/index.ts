import { combineReducers } from "redux";
import dashboard from "./dashboard";
import loader from "./loader";
import toast from "./toast";
import testimonials from "./testimonials";
import trainers from "./trainers";
import facilities from "./facilities";
import pricing from "./pricing";
import footer from "./footer";
import contact from "./contact";
import home from "./home";

const rootReducer = combineReducers({
  dashboard,
  loader,
  toast,
  testimonials,
  trainers,
  facilities,
  pricing,
  footer,
  contact, home
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
