import { Sheet } from './Sheet';

/** Окно по нажатию на логотип на главной: только текст */
export function About({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="about">
        <p>Ты уже сделал больше, чем собирался утром. Дедлайны горят, но горят и глаза. Ещё одна задача, ещё один рывок, и день твой!</p>
        <p>Помни: мы не ищем лёгких путей, мы делаем результат.</p>
        <p className="about-last">Мы сделаем всё: от минета до гандона!</p>
        <button className="primary" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </Sheet>
  );
}
