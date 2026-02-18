import { createReducer } from "reduxsauce";
import { Types } from "@Actions/toast";

export type ToastKind = "success" | "error" | "info";

export type ToastState = {
  open: boolean;
  kind: ToastKind;
  message: string;
};

const initialState: ToastState = {
  open: false,
  kind: "info",
  message: "",
};

const toastSuccess = (state: ToastState, action: any): ToastState => ({
  ...state,
  open: true,
  kind: "success",
  message: action.payload.message,
});

const toastError = (state: ToastState, action: any): ToastState => ({
  ...state,
  open: true,
  kind: "error",
  message: action.payload.message,
});

const toastInfo = (state: ToastState, action: any): ToastState => ({
  ...state,
  open: true,
  kind: "info",
  message: action.payload.message,
});

const toastClear = (): ToastState => initialState;

const toastReducer = createReducer<ToastState>(initialState, {
  [Types.TOAST_SUCCESS]: toastSuccess,
  [Types.TOAST_ERROR]: toastError,
  [Types.TOAST_INFO]: toastInfo,
  [Types.TOAST_CLEAR]: toastClear,
});

export default toastReducer;
