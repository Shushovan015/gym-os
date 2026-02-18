import { createReducer } from "reduxsauce";
import { Types } from "@Actions/loader";

export type LoaderState = {
  loading: boolean;
};

const initialState: LoaderState = {
  loading: false,
};

const loaderShow = (state: LoaderState): LoaderState => ({
  ...state,
  loading: true,
});

const loaderHide = (state: LoaderState): LoaderState => ({
  ...state,
  loading: false,
});

const loaderReducer = createReducer<LoaderState>(initialState, {
  [Types.LOADER_SHOW]: loaderShow,
  [Types.LOADER_HIDE]: loaderHide,
});

export default loaderReducer;
