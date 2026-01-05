Domain/Usecase であるアプリケーションは Port しか知らず、
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

subgraph Domain/Usecase
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
- Domain/Usecase 側から Port を依存する関係
- 外部処理は Adapter を依存する関係
のように内、外の関係を作ることが必要です。

```

```

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
└── app/
    └── ports/
        ├── driving/
        │   ├── for-adding-todo.ts
        │   ├── for-completing-todo.ts
        │   ├── for-deleting-todo.ts
        │   └── for-getting-todo.ts
        └── dto/
            └── todo-dto.ts
```


> [!TIP] ポートのディレクトリ名
> ポートのディレクトリ名に `driving` と `driven` というそのままの名前を使いましたが、
> 他にもよく使われるものでは `inbound`/`outbound`、`use-case`/`repository` などがあります。
> また ports というディレクトリだけ用意して、`use-case`/`export`/`repository`/`mailer`/`logger` など、
> より具体的な名前をつける様にしてもいいかもしれません。
> これらは名前から `Driving` なのか `Driven` なのかは明白だからです。

### クラス図

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
        updateTodo(id: string) void
    }

    class ForGettingTodo {
        <<interface>>
        getTodoById(id: string) TodoDTO
    }
}

ForAddingTodo ..> TodoDTO: use(TodoDTO)
ForCompletingTodoInbound ..> TodoDTO: use(TodoDTO)
ForGettingTodo ..> TodoDTO: use(TodoDTO)

namespace `**<span style="color:blue">app/use-case</span>**` {
    class AddTodoUsecase {
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
}

AddTodoUsecase ..|> ForAddingTodo : implements<br>(ForAddingTodo)
CompleteTodoUseCase ..|> ForCompletingTodoInbound : implements<br>(ForCompletingTodo)
CompleteTodoUseCase ..> ForUpdatingTodo: use(ForUpdatingTodo)
CompleteTodoUseCase ..> ForGettingTodo: use(ForGettingTodo)
```

pots は、契約を定義します。この定義が決まることにより
