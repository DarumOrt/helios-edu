using HeliosEdu.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HeliosEdu.Api.Adaptive;

public static class AdaptiveSeed
{
    public static async Task SeedAsync(LearningDbContext db, CancellationToken token)
    {
        const string courseId = "c-dor-ai";
        var course = await db.Courses.SingleOrDefaultAsync(item => item.Id == courseId, token);
        if (course is null || await db.Skills.AnyAsync(item => item.CourseId == courseId, token) ||
            await db.QuizQuestions.AnyAsync(item => item.CourseId == courseId, token)) return;
        course.AdaptiveEnabled = true;
        string[] ids = ["sk-dor-types", "sk-ai-tools", "sk-dor-quality", "sk-dor-build"];
        string[] titles = ["Различать виды цифровых образовательных ресурсов", "Применять инструменты генеративного ИИ",
            "Оценивать качество цифрового образовательного ресурса", "Создавать интерактивный образовательный ресурс"];
        string[] materials = ["mv1", "mp1", "md1", "ma1"];
        for (var i = 0; i < ids.Length; i++)
        {
            db.Skills.Add(new Skill { Id = ids[i], CourseId = courseId, SectionId = "s1", Code = $"ОПК-1.{i + 1}", Title = titles[i], Order = i + 1 });
            db.ActivitySkills.Add(new ActivitySkill { CourseId = courseId, ActivityId = materials[i], SkillId = ids[i] });
        }
        db.SkillPrerequisites.AddRange(
            new SkillPrerequisite { SkillId = ids[1], RequiresSkillId = ids[0] },
            new SkillPrerequisite { SkillId = ids[2], RequiresSkillId = ids[0] },
            new SkillPrerequisite { SkillId = ids[3], RequiresSkillId = ids[1] },
            new SkillPrerequisite { SkillId = ids[3], RequiresSkillId = ids[2] });
        // Первые три вопроса и ответы совпадают с актуальным quizQuestions.mq1 (src/mocks/data.ts).
        void Question(int number, int skill, string type, string text, string[] options, object correct, params string[] hints) =>
            db.QuizQuestions.Add(new QuizQuestion { Id = $"mq1q{number}", CourseId = courseId, ActivityId = "mq1", SkillId = ids[skill],
                Type = type, Text = text, Options = AdaptiveJson.Pack(options), Correct = AdaptiveJson.Pack(correct), Hints = AdaptiveJson.Pack(hints), Order = number });
        Question(1, 0, "mcq", "Что из перечисленного — цифровой образовательный ресурс?",
            ["Интерактивный тренажёр", "Бумажный учебник", "Меловая доска", "Устный опрос"], 0,
            "Ищите ресурс, работающий в цифровой среде.", "Он позволяет ученику выполнять задания и получать обратную связь.");
        Question(2, 2, "boolean", "Материалы, созданные генеративным ИИ, нужно проверять на фактические ошибки перед публикацией.", [], true,
            "Нейросеть может уверенно сообщать неверные сведения.", "Преподаватель отвечает за точность опубликованного материала.");
        Question(3, 1, "short", "Как называется текстовый запрос к генеративной нейросети?", [], "промпт",
            "Этот запрос описывает задачу и ожидаемый результат.", "Термин начинается с «пром» и заимствован из английского prompt.");
        Question(4, 0, "boolean", "Цифровой образовательный ресурс может содержать интерактивные задания.", [], true,
            "В цифровой среде можно обрабатывать действия ученика.", "Тренажёр с проверкой ответа — пример такого ресурса.");
        Question(5, 0, "mcq", "Какой ресурс лучше подходит для самостоятельной отработки навыка с обратной связью?",
            ["Список литературы", "Интерактивный тренажёр", "Фотография аудитории"], 1,
            "Ученик должен иметь возможность проверить свои действия.", "Нужен ресурс, который реагирует на ответы ученика.");
        Question(6, 1, "mcq", "Что полезно включить в запрос к ИИ для подготовки учебного материала?",
            ["Только слово «сделай»", "Цель, аудиторию и формат результата", "Случайный набор слов"], 1,
            "Нейросети нужен контекст задачи.", "Опишите, чему учить, кого учить и в каком виде нужен результат.");
        Question(7, 1, "boolean", "Результат генерации можно уточнять дополнительными запросами.", [], true,
            "Первый ответ может не соответствовать всем требованиям.", "Уточнение запроса позволяет исправить и дополнить результат.");
        Question(8, 2, "mcq", "Что следует сделать перед публикацией созданного ИИ учебного текста?",
            ["Проверить факты и соответствие учебной цели", "Удалить все источники", "Сразу отправить ученикам"], 0,
            "Красивое оформление не гарантирует правильность содержания.", "Сверьте сведения с надёжными источниками и задачами обучения.");
        Question(9, 2, "boolean", "Проверка доступности материала для учеников входит в оценку качества ЦОР.", [], true,
            "Материал должен быть пригоден для целевой аудитории.", "Проверьте читаемость, навигацию, субтитры и альтернативные описания.");
        Question(10, 3, "mcq", "С чего следует начинать разработку интерактивного учебного ресурса?",
            ["Со случайного выбора эффектов", "С определения учебной цели и сценария", "С публикации незавершённого шаблона"], 1,
            "Сначала определите ожидаемый результат обучения.", "Цель и действия ученика задают структуру будущего ресурса.");
        Question(11, 3, "boolean", "Перед использованием тренажёра следует проверить задания и обратную связь на типичных ответах.", [], true,
            "Рабочая кнопка ещё не означает, что тренажёр обучает правильно.", "Пройдите сценарии с верными, неверными и пустыми ответами.");
        Question(12, 3, "short", "Как называется реакция тренажёра на ответ ученика, помогающая понять ошибку?", [], "обратная связь",
            "Ученик должен узнать, что получилось и что нужно исправить.", "Это два слова: первое — «обратная».");
        await db.SaveChangesAsync(token);
    }
}
