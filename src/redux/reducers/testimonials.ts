import {
  GET_TESTIMONIALS_REQUEST,
  GET_TESTIMONIALS_SUCCESS,
  GET_TESTIMONIALS_FAILURE,
} from "@src/redux/actions/testimonials";

const initialState = {
  items: [],
  loading: false,
  error: null as string | null,
};

export default function testimonialsReducer(state = initialState, action: any) {
  switch (action.type) {
    case GET_TESTIMONIALS_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_TESTIMONIALS_SUCCESS:
      return { ...state, loading: false, items: action.payload };
    case GET_TESTIMONIALS_FAILURE:
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}
