import { combineReducers } from "redux";
import dashboard from "./dashboard";

const rootReducer = combineReducers({
  dashboard,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
