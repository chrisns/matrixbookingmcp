use typescript to develop a MCP server that will allow me to check availability.
you can reference the official documentation at https://developers.matrixbooking.com/ .
you should research the best way to implement the MCP server in typescript and include comprehensive testing for this.
you should mock the matrixbooking API to test the MCP server.

I should be able to specify the credentials in a .env file that is not checked in to the repo.
while you are working you should make semantic commits between each step of the development.

while it is not obvious from the matrix booking documentation, the MCP server is a REST API that can also be used to book appointments, in the bookexample.js file you can see an example of how to book an appointment that I extracted from a browser developer tools network tab, you can take the method (POST) and the format of the body and use that to implement a function that will book an appointment.

I would like to be able to ask the MCP server to check availability for a given date and time, and then book an appointment if the date and time is available, it should be able to tell me room availability, if I don't specify the date assume that it is today, if I don't specify the location assume that is MATRIX_PREFERED_LOCATION from the .env file

the app should be completely stateless, no caching, the current .env files has MATRIX_USERNAME, MATRIX_PASSWORD, MATRIX_PREFERED_LOCATION defined, you should not need any other configuration.