const headElem = document.getElementById("head");
const buttonsElem = document.getElementById("buttons");
const pagesElem = document.getElementById("pages");



// Возможные варианты ответа
const options = ["нет", "скорее да", "определенно да"]

// Список направлений
const profiles = 
[
	"ИИ", "Геном", "ВРС"
]

const p_count = profiles.length;

// Список вопросов
const data_questions = 
[
	"Меня интересует биология",
	"Я увлекаюсь роботехникой", 
	"Нейросети - самая захватывающая сфера новых технологий",
	"У умею программировать на Python"
]

// Матрица соответствия. По столбцам - профили, по строкам - вопросы. 
// На пересечении "1" у тех вопросов, которые дают балл для соответствующего профиля.
const data_results = 
[
	[0, 1, 0],
	[0, 0, 1],
	[1, 0, 0],
	[1, 0, 1]
];

// Максимально возможное количество баллов, которое можно набрать за профиль
const max_results_by_profile = new Array(profiles.length)
for (var i = 0; i < p_count; i++) {
	var sum = 0;
	for (var j = 0; j < data_questions.length; j++) {
		sum += data_results[j][i];
	}
	//console.log(sum);
	max_results_by_profile[i] = sum * 2;
}


//Класс, который представляет сам тест
class Quiz
{
	constructor(type, questions, recommendations)
	{
		//Тип теста: 1 - классический тест с правильными ответами, 2 - тест без правильных ответов
		this.type = type;

		//Массив с вопросами
		this.questions = questions;

		//Массив с возможными результатами
		this.recommendations = Array.from(recommendations);

		//Количество набранных очков по каждому профилю
		this.score = new Array(p_count);
		for (var i = 0; i < p_count; i++) {
			this.score[i] = 0;
		}

		//Номер результата из массива
		this.result = "Здесь будет ваш результат!!";

		//Номер текущего вопроса
		this.current = 0;
	}

	Click(index)
	{
		//Добавляем очки
		let value = this.questions[this.current].Click(index);
		console.log(this.current);
		//this.score += value;
		for (var i = 0; i < p_count; i++){
			this.score[i] += data_results[this.current][i] * value;
		}

		let correct = -1;

		//Если было добавлено хотя одно очко, то считаем, что ответ верный
		if(value >= 1)
		{
			correct = index;
		}
		else
		{
			//Иначе ищем, какой ответ может быть правильным
			for(let i = 0; i < this.questions[this.current].answers.length; i++)
			{
				if(this.questions[this.current].answers[i].value >= 1)
				{
					correct = i;
					break;
				}
			}
		}

		this.Next();

		return correct;
	}

	//Переход к следующему вопросу
	Next()
	{
		this.current++;
		
		if(this.current >= this.questions.length) 
		{
			this.End();
		}
	}

	//Если вопросы кончились, этот метод проверит, какой результат получил пользователь
	End()
	{
		for (var i = 0; i < p_count; i++){
			this.score[i] = Math.floor(this.score[i] / max_results_by_profile[i] * 100);
		}
		// сортируем массив профилей по убыванию результатов
		var temp = {};
		for (var i = 0; i < p_count; i++){
			temp[this.recommendations[i]] = this.score[i];
		}
		this.recommendations.sort(function(a, b) {
			return temp[b] - temp[a]
		});
		
		this.score.sort(function(a, b) {
			return b - a
		});
		
		if (this.score[p_count - 1] == 100) {
			this.result = "Вы уверены, что искренне отвечали на вопросы? Советуем пройти тест еще раз."
		}
		else if (this.score[0] < 50){
			this.result = "Кажется вас не заинтересует ни один из профилей :( Проанализируйте свои ответы и попробуйте пройти тест еще раз."
		}
		else{
			this.result = "Рекомендуемые вам профили: ";
			var i = 0;
			do {
				this.result += this.recommendations[i] + "(" + this.score[i].toString() + "%), ";
				i++;
			}
			while(this.score[i] >= 50 && i <= 5);
			this.result = this.result.substr(0, this.result.length - 2)
		}
	
		
		console.log(this.score[0]);
		console.log(this.recommendations[0]);
	}
} 

//Класс, представляющий вопрос
class Question 
{
	constructor(text, answers)
	{
		this.text = text; 
		this.answers = answers; 
	}

	Click(index) 
	{
		return this.answers[index].value; 
	}
}

//Класс, представляющий ответ
class Answer 
{
	constructor(text, value) 
	{
		this.text = text; 
		this.value = value; 
	}
}


//Массив с вопросами
questions = [];
questions.length = data_questions.length;
for (var i = 0; i < data_questions.length; i++) {
	questions[i] = new Question(data_questions[i], 
	[
		new Answer(options[0], 0),
		new Answer(options[1], 1),
		new Answer(options[2], 2)
	]);
}


//Сам тест
const quiz = new Quiz(2, questions, profiles);

Update();

//Обновление теста
function Update()
{
	//Проверяем, есть ли ещё вопросы
	if(quiz.current < quiz.questions.length) 
	{
		//Если есть, меняем вопрос в заголовке
		headElem.innerHTML = quiz.questions[quiz.current].text;

		//Удаляем старые варианты ответов
		buttonsElem.innerHTML = "";

		//Создаём кнопки для новых вариантов ответов
		for(let i = 0; i < quiz.questions[quiz.current].answers.length; i++)
		{
			let btn = document.createElement("button");
			btn.className = "button";

			btn.innerHTML = quiz.questions[quiz.current].answers[i].text;

			btn.setAttribute("index", i);

			buttonsElem.appendChild(btn);
		}
		
		//Выводим номер текущего вопроса
		pagesElem.innerHTML = (quiz.current + 1) + " / " + quiz.questions.length;

		//Вызываем функцию, которая прикрепит события к новым кнопкам
		Init();
	}
	else
	{
		//Если это конец, то выводим результат
		buttonsElem.innerHTML = "";
		headElem.innerHTML = quiz.result;
		// pagesElem.innerHTML = "Еще какой-то текст "; // + quiz.score;
	}
}

function Init()
{
	//Находим все кнопки
	let btns = document.getElementsByClassName("button");

	for(let i = 0; i < btns.length; i++)
	{
		//Прикрепляем событие для каждой отдельной кнопки
		//При нажатии на кнопку будет вызываться функция Click()
		btns[i].addEventListener("click", function (e) { Click(e.target.getAttribute("index")); });
	}
}

function Click(index) 
{
	//Получаем номер правильного ответа
	let correct = quiz.Click(index);

	//Находим все кнопки
	let btns = document.getElementsByClassName("button");

	//Делаем кнопки серыми
	for(let i = 0; i < btns.length; i++)
	{
		btns[i].className = "button button_passive";
	}

	//Если это тест с правильными ответами, то мы подсвечиваем правильный ответ зелёным, а неправильный - красным
	if(quiz.type == 1)
	{
		if(correct >= 0)
		{
			btns[correct].className = "button button_correct";
		}

		if(index != correct) 
		{
			btns[index].className = "button button_wrong";
		} 
	}
	else
	{
		//Иначе просто подсвечиваем зелёным ответ пользователя
		btns[index].className = "button button_correct";
	}

	//Ждём секунду и обновляем тест
	setTimeout(Update, 1000);
}
