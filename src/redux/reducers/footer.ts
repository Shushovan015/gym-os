import {
  GET_FOOTER_REQUEST,
  GET_FOOTER_SUCCESS,
  GET_FOOTER_FAILURE,
} from "@src/redux/actions/footer";

const initialState = {
  item: null as any,
  loading: false,
  error: null as string | null,
};

export default function footer(state = initialState, action: any) {
  switch (action.type) {
    case GET_FOOTER_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_FOOTER_SUCCESS:
      return { ...state, loading: false, item: action.payload };
    case GET_FOOTER_FAILURE:
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}
