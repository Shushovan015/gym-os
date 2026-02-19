import {
  GET_FACILITIES_REQUEST,
  GET_FACILITIES_SUCCESS,
  GET_FACILITIES_FAILURE,
} from "@src/redux/actions/facilities";

const initialState = {
  items: [],
  loading: false,
  error: null as string | null,
};

export default function facilities(state = initialState, action: any) {
  switch (action.type) {
    case GET_FACILITIES_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_FACILITIES_SUCCESS:
      return { ...state, loading: false, items: action.payload };
    case GET_FACILITIES_FAILURE:
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}
