import { combineReducers } from "redux";
import dashboard from "./dashboard";
import loader from "./loader";
import toast from "./toast";

const rootReducer = combineReducers({
  dashboard,
  loader,     
  toast,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
