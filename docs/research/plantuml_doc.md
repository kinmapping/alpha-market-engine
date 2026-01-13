## Define a Class

``` plantuml
scale 500 width
abstract abstract
abstract class "abstract class"
annotation annotation
circle circle
() circle_short_form
class class
class class_stereo <<stereotype>>
diamond diamond
<> diamond_short_form
entity entity
enum enum
exception exception
interface interface
metaclass metaclass
protocol protocol
stereotype stereotype
struct struct

```

## Relation

```plantuml
A <|-- B: 継承
C *-- D: 構成
E o-- F: 集約
G <-- H: 協会
```
```plantuml
I -- J: 関連(実線)
K <.. L: 依存
M <|.. N: 実装
O .. P: 関連(点線)
```
### 矢印の向きをかえる
`--` ではなく、単一の `-` のすることで水平方向に並べます。
```plantuml
Room o- Student
Room *-- Chair
```
リレーションの矢印を反対にすることで並び替えます。
```plantuml
Student -o Room
Chair --* Room
```
さらに、キーワード left, right, up, down を矢印の内側に置くことにより、矢印の方向を変えることも可能で
す
```plantuml
foo -left-> dummyLeft
foo -right-> dummyRight
foo -up-> dummyUp
foo -down-> dummyDown
```
矢印の長短を調整するには
```plantuml
left to right direction
foo -left-> dummyLeft
foo -right-> dummyRight
foo -up-> dummyUp
foo -down-> dummyDown
```
(レイアウトの方向を変更)


### 矢印の太さ
```plantuml
title Bracketed line style without label
class foo
class Bar
class Bold
class Dashed
class Dotted
class Hidden
class Plain
class Thickness

' relation
foo --> Bar: plain と同じ
foo -[bold]-> Bold: bold
foo -[dashed]-> Dashed: dashed
foo -[dotted]-> Dotted: dotted
foo -[hidden]-> Hidden: hidden
foo -[thickness=8]-> Thickness: thickness=8
foo -[plain]-> Plain: デフォルト
```

### 矢印の色を変える
```plantuml
title Bracketed line color
class foo
class bar
bar1 : [#red]
bar2 : [#green]
bar3 : [#blue]
foo --> bar
foo -[#red,bold]-> bar1 : [#red]
foo -[#green,dashed,thickness=7]-> bar2 : [#green]
foo -[#blue,dotted,thickness=7]-> bar3 : [#blue]
'foo -[#blue;#yellow;#green]-> bar4
```

### クラスメンバ間の矢印
```plantuml
class Foo {
    + field1
    + field2
}

class Bar {
    + field3
    + field4
}

Foo::field1 --> Bar::field3 : foo
Foo::field2 --> Bar::field4 : bar
```

### 要素の整列
```plantuml
package app {}
package database {}

app -[hidden]- database
```


## label
```plantuml
class Car
Driver - Car : drives >
Car *- Wheel : have 4 >
Car -- Person : < owns
```

### alias
要素に別名(エイリアス)
```plantuml
class "This is my class" as class1
class class2 as "It works this way too"
class2 *-- "foo/dummy" : use
```

## Filed & Method
```plantuml
Object <|-- ArrayList
Object : equals()
ArrayList : Object[] elementData
ArrayList : size()
```

```plantuml
class Dummy {
String data
void methods()
}
class Flight {
flightNumber : Integer
departureTime : Date
}
```

### Visibility

|記号|説明|
|---|---|
|`+`| Public|
|`-`| Private|
|`#`| Protected|
|`~`| Package/Internal|

```plantuml
class Dummy {
    -privateField1
    #protectedField2
    ~packageMethod1()
    +publicMethod2()
}
```
コマンド `skinparam classAttributeIconSize 0` を使用してこの機能を切ることができます
```plantuml
skinparam classAttributeIconSize 0
class Dummy {
-field1
#field2
~method1()
+method2()
}
```

### メソッドの定義(Abstract と Static)

```plantuml
class Dummy {
    {static} String id
    {abstract} void methods()
}

```

## 高等なクラス本体

```plantuml
class Foo1 {
    You can use
    several lines
    ..
    as you want
    and group
    ==
    things together.
    __
    You can have as many groups
    as you want
    --
    End of class
}

class User {
    .. Simple Getter ..
    + getName()
    + getAddress()
    .. Some setter ..
    + setName()
    __ private data __
    int age
    -- encrypted --
    String password
}
```

## 注釈とステレオタイプ
```plantuml
scale 500 width
class Object << general >>
Object <|--- ArrayList
note top of Object : In java, every class\nextends this one.
note "This is a floating note" as N1
note "This note is connected\nto several objects." as N2
Object .. N2
N2 .. ArrayList
class Foo
note left: On last defined class
```

### HTML タグを使用
```plantuml
scale 500 width
class Foo
note left: On last defined class

note top of Foo
    In java, <size:18>every</size> <u>class</u>
    <b>extends</b>
    <i>this</i> one.
end note

note as N1
    This note is <u>also</u>
    <b><color:royalBlue>on several</color>
    <s>words</s> lines
    And this is hosted by <img:sourceforge.jpg>
end note
```

### フィールド・メソッドへの注釈
```plantuml
scale 500 width
class A {
    {static} int counter
    +void {abstract} start(int timeout)
}

note right of A::counter
    This member is annotated
end note

note left of A::start
    This method is now explained in a UML note
end note
```

同名のメソッドへの注釈には、

```plantuml
scale 500 width
class A {
    {static} int counter
    +void {abstract} start(int timeoutms)
    +void {abstract} start(Duration timeout)
}

note left of A::counter
    This member is annotated
end note

note right of A::"start(int timeoutms)"
    This method with int
end note

note right of A::"start(Duration timeout)"
    This method with Duration
end note
```
### リンクへの注釈
リンク定義の直後に note on link を使用して、リンクに注釈を加えることが可能です。
もし注釈の相対位置を変えたい場合には、
ラベル `note left on link`, `note right on link`,
`note top on link`, `note bottom on link` も使用できます。

```plantuml
class Dummy
Dummy --> Foo : A link
note on link #red: note that is red
Dummy --> Foo2 : Another link
note right on link #blue
this is my note on right link
and in blue
end note
```

## パッケージ/名前空間
```plantuml
package "Classic Collections" #DDDDDD {
    Object <|-- ArrayList
}

package com.plantuml {
    Object <|-- Demo1
    Demo1 *- Demo2
}
```

### パッケージスタイル
```plantuml
scale 500 width
package foo1 <<Node>> {
    class Class1
}

package foo2 <<Rectangle>> {
    class Class2
}

package foo3 <<Folder>> {
    class Class3
}

package foo4 <<Frame>> {
    class Class4
}

package foo5 <<Cloud>> {
    class Class5
}

package foo6 <<Database>> {
    class Class6
}
```

### パッケージ間のリンク
```plantuml
scale 200 width
skinparam packageStyle rectangle
package foo1.foo2 {
}
package foo1.foo2.foo3 {
    class Object
}
foo1.foo2 +-- foo1.foo2.foo3
```


### セパレータフォーマットの変更
```plantuml
set separator ::
class X1::X2::foo {
some info
}
```
