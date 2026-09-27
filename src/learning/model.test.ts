import {expect,test} from 'vitest';
import * as model from './model';
test('numeric comparison accepts decimal comma, explicit units and tolerance, rejects empty and incompatible unit',()=>{
 const spec={value:18.68,unit:'A',tolerance:0.02};
 expect(model.checkNumeric('18,68','A',spec)).toBe('richtig');
 expect(model.checkNumeric('18.70','A',spec)).toBe('richtig');
 expect(model.checkNumeric('18.8','A',spec)).toBe('falsch');
 expect(model.checkNumeric('','A',spec)).toBe('invalid');
 expect(model.checkNumeric('18.68abc','A',spec)).toBe('invalid');
 expect(model.checkNumeric('18.68','V',spec)).toBe('invalid');
});
test('U final result requires all subparts assessed by the user',()=>{
 expect(model.combineAssessments(['richtig',null])).toBe(null);
 expect(model.combineAssessments(['richtig','richtig'])).toBe('richtig');
 expect(model.combineAssessments(['richtig','falsch'])).toBe('teilweise');
 expect(model.combineAssessments(['falsch','falsch'])).toBe('falsch');
});
