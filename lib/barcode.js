export function validBarcode(code) {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  let sum = 0;
  for(let i=code.length-2,weight=3;i>=0;i--,weight=weight===3?1:3) sum += Number(code[i])*weight;
  return (10-sum%10)%10 === Number(code.at(-1));
}
