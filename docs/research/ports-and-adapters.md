# Ports & Adapters (ヘキサゴナルアーキテクチャ) について

## フロー図

Domain/UseCase であるアプリケーションは Port しか知らず、
外部接続は Adapter しか知らない

```mermaid
---
title: Ports & Adapters パターン
---
flowchart TB


subgraph 利用する外部
direction RL
    web[WEB]
    cli[CLI]
end

subgraph 利用される外部
    str[(STRAGE)]
    db[(DataBase)]
end

subgraph Driving P&A
    pa1@{ shape: trap-t , label: 'Driving Adapters<br>(Primary Adapters)'}
    pa2@{ shape: trap-t , label: 'Driving Adapters<br>(Primary Adapters)'}
    pp1@{ shape: das , label: 'Driving Port<br>(Primary Ports)'}
    pp2@{ shape: das , label: 'Driving Port<br>(Primary Ports)'}

end

subgraph Driven P&A
    sa1@{ shape: trap-t , label: 'Driven Adapters<br>(Secondary Adapters)'}
    sa2@{ shape: trap-t , label: 'Driven Adapters<br>(Secondary Adapters)'}
    sp1@{ shape: das , label: 'Driven Ports<br>(Secondary Ports)'}
    sp2@{ shape: das , label: 'Driven Ports<br>(Secondary Ports)'}
end

subgraph Domain/UseCase
    app((application))
end

%% relation
web e1@<==> pa1 e2@==> pp1 e3@<==> app
cli e4@<==> pa2 e5@==> pp2 e6@<==> app

app e7@<==> sp1 e8@==> sa1 e9@<==> str
app e10@<==> sp2 e11@==> sa2 e12@<==> db

%% animate
e1@{ animate: true }
e2@{ animate: true }
e3@{ animate: true }
e4@{ animate: true }
e5@{ animate: true }
e6@{ animate: true }
e7@{ animate: true }
e8@{ animate: true }
e9@{ animate: true }
e10@{ animate: true }
e11@{ animate: true }
e12@{ animate: true }
```
この設計において、Port はその境界の形状 (interface) を決めるだけではなく、
依存の方向も決定することが責務として持たれる
- Domain/UseCase 側から Port を依存する関係
- 外部処理は Adapter を依存する関係
のように内、外の関係を作ることが必要です。



Port は単なる interface ではない
| 項目    | interface | port  |
| ----- | --------- | ----- |
| 実装    | 持たない      | 持たない  |
| 目的    | 型の抽象化     | 境界の定義 |
| 依存方向  | 任意        | 固定    |
| 設計意図  | 薄い        | 強い    |
| テスト境界 | 不明確       | 明確    |


## 　TODO処理を参考に

### ディレクトリ階層

```
.
├── app/
│   ├── ports/
│   │   ├── driving/
│   │   │   ├── for-adding-todo.ts
│   │   │   ├── for-completing-todo.ts
│   │   │   ├── for-deleting-todo.ts
│   │   │   └── for-getting-todo.ts
│   │   ├── driven/
│   │   │   ├── for-creating-todo.ts
│   │   │   ├── for-deleting-todo.ts
│   │   │   ├── for-updating-todo.ts
│   │   │   └── for-getting-todo.ts
│   │   └── dto/
│   │       └── todo-dto.ts
│   └── use-cases/
│       ├── add-todo-use-case.ts
│       ├── complete-todo-use-case.ts
│       ├── delete-todo-use-case.ts
│       └── get-todo-use-case.ts
└── database/
    └── mysql/
        ├── create-todo-command.ts
        ├── update-todo-command.ts
        ├── delete-todo-command.ts
        └── get-todo-query.ts
```


> [!TIP] ポートのディレクトリ名
> ポートのディレクトリ名に `driving` と `driven` というそのままの名前を使いましたが、
> 他にもよく使われるものでは `inbound`/`outbound`、`use-case`/`repository` などがあります。
> また ports というディレクトリだけ用意して、`use-case`/`export`/`repository`/`mailer`/`logger` など、
> より具体的な名前をつける様にしてもいいかもしれません。
> これらは名前から `Driving` なのか `Driven` なのかは明白だからです。

### クラス図
Driving Port は、アプリケーション側でどのような振る舞いを行なうのかを定義しています。
Driven Port は、外部接続との境界を定義してその内容は外部ノードへの通信を行なう振る舞いを定義しています。

例えば `AddTodoUseCase` は、Driving Port で定義された `ForAddingTodo` を実装します。
実装するメソッドの `addTodo` の処理内容は Driven Port である `ForCreatingTodo` を DI して、外部接続用のメソッドを実行するといった内容です。
これはつまり、アプリケーション側では契約の境界をつかって処理を実行しているが、
接続のための処理はまったく内側からは見えないというヘキサゴナルアーキテクチャに則った方針を実現しています。

```mermaid
classDiagram
direction LR

namespace `**<span style="color:blue">app/ports/dto</span>**` {
    class TodoDTO {
        id: string
        title: string
        done: boolean
    }
}

namespace `**<span style="color:blue">app/ports/driving</span>**` {
    class ForAddingTodo {
        <<interface>>
        addTodo(todo: TodoDTO) TodoDTO
    }
    class ForCompletingTodoInbound["ForCompletingTodo"] {
        <<interface>>
        completeTodo(id: string) TodoDTO
    }
    class ForDeletingTodoInbound["ForDeletingTodo"] {
        <<interface>>
        deleteTodo(id: string) void
    }
    class ForGettingTodoInbound["ForGettingTodo"] {
        <<interface>>
        getTodo(id: string) TodoDTO
    }
}

namespace `**<span style="color:blue">app/ports/driven</span>**` {
    class ForCreatingTodo {
        <<interface>>
        createTodo(todo: TodoDTO) TodoDTO
    }

    class ForDeletingTodo {
        <<interface>>
        deleteTodo(id: string) void
    }

    class ForUpdatingTodo {
        <<interface>>
        updateTodo(todo: TodoDTO) TodoDTO
    }

    class ForGettingTodo {
        <<interface>>
        getTodoById(id: string) TodoDTO
    }
}

namespace `**<span style="color:blue">app/use-case</span>**` {
    class AddTodoUseCase {
        -_forCreatingTodo: ForCreatingTodo
        +constructor(forCreatingTodo: ForCreatingTodo)
        +addTodo(todo: TodoDTO) TodoDTO
    }

    class CompleteTodoUseCase {
        -_forUpdatingTodo: ForUpdatingTodo
        -_forGettingTodo: ForGettingTodo
        +constructor(forUpdatingTodo: ForUpdatingTodo, forGettingTodo: ForGettingTodo)
        +completeTodo(id: string) TodoDTO
    }

    class DeleteTodoUseCase {
        -_forDeletingTodo: ForDeletingTodoDrivenPort
        +constructor(forDeletingTodo: ForDeletingTodoDrivenPort)
        +deleteTodo(id: string) void
    }

    class GetTodoUseCase {
        -_forGettingTodo: ForGettingTodoDrivenPort
        +constructor(forGettingTodo: ForGettingTodoDrivenPort)
        +getTodo(id: string) TodoDTO
    }
}

namespace `**<span style="color:green">database/mysql</span>**` {
    class CreateTodoCommand {
        +createTodo(todo: TodoDTO) TodoDTO
    }
    class UpdateTodoCommand {
        +updateTodo(todo: TodoDTO) TodoDTO
    }
    class DeleteTodoCommand {
        +deleteTodo(todo: TodoDTO) TodoDTO
    }
    class GetTodoCommand {
        +getTodoById(id: string) TodoDTO
    }
}

%% relation
%% use TodoDTO
ForAddingTodo ..> TodoDTO: use(TodoDTO)
ForCompletingTodoInbound ..> TodoDTO: use(TodoDTO)
ForGettingTodoInbound ..> TodoDTO: use(TodoDTO)
ForCreatingTodo ..> TodoDTO: use(TodoDTO)
ForUpdatingTodo ..> TodoDTO: use(TodoDTO)
ForGettingTodo ..> TodoDTO: use(TodoDTO)

%% inbound direction
AddTodoUseCase --|> ForAddingTodo : implements<br>(ForAddingTodo)
AddTodoUseCase ..> ForCreatingTodo: DI(ForCreatingTodo)
CompleteTodoUseCase --|> ForCompletingTodoInbound : implements<br>(ForCompletingTodo)
CompleteTodoUseCase ..> ForUpdatingTodo: DI(ForUpdatingTodo)
CompleteTodoUseCase ..> ForGettingTodo: DI(ForGettingTodo)
DeleteTodoUseCase --|> ForDeletingTodoInbound : implements<br>(ForDeletingTodo)
DeleteTodoUseCase ..> ForDeletingTodo: DI(ForDeletingTodo)
GetTodoUseCase --|> ForGettingTodoInbound : implements<br>(ForGettingTodoInbound)
GetTodoUseCase ..> ForGettingTodo: DI(ForGettingTodo)

%% outbound direction
CreateTodoCommand --|> ForCreatingTodo : implements<br>(ForCreatingTodo)
UpdateTodoCommand --|> ForUpdatingTodo : implements<br>(ForUpdatingTodo)
DeleteTodoCommand --|> ForDeletingTodo : implements<br>(ForDeletingTodo)
GetTodoCommand --|> ForGettingTodo : implements<br>(ForGettingTodo)
```

pots は、契約を定義します。この定義が決まることによりアプリケーション側、外部接続側での実装が決まっていきます。

**Ports**
- 設計を固定するためのクラス
- 明示的に interface / 抽象として現れる

**Adapters**

- Port を 実装する具体クラス
- 名前は技術・用途ごとにバラバラ
- 「Adapter」という名前を持たないことが普通

今回でいうと
> [!NOTE] Adapters クラスとは？
> P&A アーキテクチャにおいて、Adapters という名前をつけたクラスは定義していませんでした。
> 実際には、Ports によって定義した形式(interface)をつかって実装されたクラスのことを指します。
> 今回でいうと、`app/use-case` 配下の Driving Ports を実装したクラス、
> `database/mysql` 配下の Driven Ports を実装したクラスがそれに当たります。


## 用意したクラスの配線

ポートやアダプターといった言葉から必要なクラスを用意できましたが、
ここから、用意したクラスの結束をして配線を行なう処理(設定)が必要となります。

フレームワークですでに用意していることもあります。(たとえば、Laravel なら `config/*.php` など)
例えば、以下のように配線を組む設定クラスを用意することができます。
```ts
// app/configulater.ts
export class Configulater {

    private _drivenPorts: {
        forCreatingTodo: ForCreatingTodo;
        forUpdatingTodo: ForUpdatingTodo;
        forDeletingTodo: ForDeletingTodo;
        forGettingTodo: ForGettingTodo;
    }

    public constructor(drivenPorts: {
        forCreatingTodo: ForCreatingTodo;
        forUpdatingTodo: ForUpdatingTodo;
        forDeletingTodo: ForDeletingTodo;
        forGettingTodo: ForGettingTodo;
    }) {
        this._drivenPorts = { ...drivenPorts };
    }

    public drivenPorts = () => { ...this._drivenPorts };
}
```
さらい Application クラスが生成されるときに、外部接続処理のインスタンスを作成するようにします。
```ts
// app/facade.ts
export class Application {

    private _config: Configuater;

    public constructor(config: Configuater) {
        this._config = config;
    }

    public forAddingTodo = (): ForAddingTodo => {
        return new AddTodoUseCase(this._config.drivenPorts().forCreatingTodo);
    }

    public forCompletingTodo = (): ForCompletingTodo => {
        return new CompleteTodoUseCase(
            this._config.drivenPorts()forUpdatingTodo,
            this._config.drivenPorts().forGettingTodo);
    }

    public forDeletingTodo = (): ForDeletingTodo => {
        return new DeleteTodoUseCase(this._config.drivenPorts().forDeletingTodo);
    }

    public forGettingTodo = (): ForGettingTodo => {
        return new GetTodoUseCase(this._config.drivenPorts().forGettingTodo);
    }
}
```
これで、アプリケーションを起動させるときに
```ts
const app = new Application(
    new Configuater({
        forCreatingTodo: new CreateTodoCommand(),
        forUpdatingTodo: new UpdateTodoCommand(),
        forDeletingTodo: new DeleteTodoCommand(),
        forGettingTodo: new GetTodoQuery(),
    })
);

const todo = app.forAddingTodo.addTodo({
    id: '',
    title: 'Todo1',
    done: false,
});

app.forCompletingTodo.completeTodo(todo.id);

app.forDeletingTodo.deleteTodo(todo.id);
```

このように仕組むことで、設定クラスでアダプタクラスを切り替えることで外部ノードを変更することができます。


## 参考
- [Ports & Adapters パターン：Hexagonal Architecture Explained を手元に](https://zenn.dev/kkatou/articles/ports-and-adapters-explained)
