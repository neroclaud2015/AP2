import scopes from '../../public/data/manual_answer_review_scopes.json';
export const REVIEW_SCOPES=scopes;
export function resolveReviewScope(scope:string|null){
 const found=REVIEW_SCOPES.find(s=>s.scope===(scope??'winter-2018-19-ap-fa'));
 if(!found)throw Error('Unbekannter Review-Bereich');
 return found;
}
