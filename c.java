import java.util.Scanner;

public class c {
    public static void main(String[] s) {  

        Scanner sc = new Scanner(System.in);

        System.out.println("enter your physics marks:");
        int physics = sc.nextInt();

        System.out.println("enter your chemistry marks:");  
        int chemistry = sc.nextInt();

        System.out.println("enter your mathematics marks:");
        int mathematics = sc.nextInt();

        System.out.println("enter your computer marks:");
        int computer = sc.nextInt(); 

        System.out.println("enter your english marks:");
        int english = sc.nextInt();

        float percentage = (physics + chemistry + mathematics + computer + english) / 500.0f * 100;
        System.out.println("Percentage:");
        System.out.println(percentage);
    }

}