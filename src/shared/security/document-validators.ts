export function isRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

export function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11 || isRepeatedDigits(cpf)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  const firstDigit = remainder === 10 ? 0 : remainder;
  if (firstDigit !== Number(cpf.charAt(9))) {
    return false;
  }

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(cpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  const secondDigit = remainder === 10 ? 0 : remainder;
  return secondDigit === Number(cpf.charAt(10));
}

export function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || isRepeatedDigits(cnpj)) {
    return false;
  }

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, ...firstWeights];

  let sum = 0;
  firstWeights.forEach((weight, index) => {
    sum += Number(cnpj.charAt(index)) * weight;
  });
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== Number(cnpj.charAt(12))) {
    return false;
  }

  sum = 0;
  secondWeights.forEach((weight, index) => {
    sum += Number(cnpj.charAt(index)) * weight;
  });
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  return secondDigit === Number(cnpj.charAt(13));
}
