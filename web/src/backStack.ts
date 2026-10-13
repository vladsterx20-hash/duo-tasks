/**
 * Окна поверх экрана (просмотрщик файла) перехватывают кнопку «Назад»: нажатие закрывает окно,
 * а не уводит с экрана задачи. Последнее зарегистрированное окно закрывается первым.
 */
const stack: Array<() => void> = [];

export function pushBack(handler: () => void): () => void {
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** true — «Назад» обработано открытым окном */
export function handleBack(): boolean {
  const h = stack[stack.length - 1];
  if (!h) return false;
  h();
  return true;
}
