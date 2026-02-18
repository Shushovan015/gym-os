import { createActions } from "reduxsauce";

export const { Types, Creators } = createActions({
  toastSuccess: ["payload"], // { message }
  toastError: ["payload"],   // { message }
  toastInfo: ["payload"],    // { message }
  toastClear: null,
});

export default Creators;
