import {
  GET_PROSHOP_REQUEST,
  GET_PROSHOP_SUCCESS,
  GET_PROSHOP_FAILURE,
} from "@src/redux/actions/proShop";

const initialState = {
  items: [],
  content: null as any,
  loading: false,
  error: null as string | null,
};

export default function proshop(state = initialState, action: any) {
  switch (action.type) {
    case GET_PROSHOP_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_PROSHOP_SUCCESS: {
      const payload = action.payload;
      const items = Array.isArray(payload) ? payload : payload?.items ?? [];
      const content = Array.isArray(payload) ? state.content : payload?.content ?? null;
      return { ...state, loading: false, items, content };
    }
    case GET_PROSHOP_FAILURE:
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}
