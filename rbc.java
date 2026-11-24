 interface animal{
    void display();
 }
 class dog implements animal{
    public void display(){
        System.out.println("This is a dog");
    }
}
  public class rbc{
    public static void main(String[] args) {
        dog sonu = new dog();

        sonu.display();
    }
}


    

