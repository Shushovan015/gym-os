import {
  GET_CONTACT_REQUEST,
  GET_CONTACT_SUCCESS,
  GET_CONTACT_FAILURE,
} from "@src/redux/actions/contact";

const initialState = {
  content: null as any,
  faqs: [] as any[],
  loading: false,
  error: null as string | null,
};

export default function contact(state = initialState, action: any) {
  switch (action.type) {
    case GET_CONTACT_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_CONTACT_SUCCESS:
      return {
        ...state,
        loading: false,
        content: action.payload?.content ?? null,
        faqs: action.payload?.faqs ?? [],
      };
    case GET_CONTACT_FAILURE:
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}
