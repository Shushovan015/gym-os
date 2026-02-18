import { createActions } from "reduxsauce";

export const { Types, Creators } = createActions({
  loaderShow: null,
  loaderHide: null,
});

export default Creators;
